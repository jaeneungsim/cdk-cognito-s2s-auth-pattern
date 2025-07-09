const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');
const fetch = require('node-fetch');

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

// PROTOTYPE: Replace with your 32-character encryption key (must match App2)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'prototype-key-32-chars-long1234!'; // EXAMPLE: Replace with actual key

exports.handler = async (event) => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const body = JSON.parse(event.body || '{}');
    const newUsername = body.username;
    const newPassword = body.password;
    const humanUserId = body.human_user_id;
    
    // Check required parameters
    if (!newUsername || !newPassword || !humanUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required parameters: username, password, human_user_id'
        })
      };
    }
    
    // 1. Login to App2 with API client credentials
    const apiClientLoginParams = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.API_CLIENT_ID,
      AuthParameters: {
        USERNAME: process.env.API_CLIENT_USERNAME,
        PASSWORD: process.env.API_CLIENT_PASSWORD,
        SECRET_HASH: calculateSecretHash(process.env.API_CLIENT_USERNAME, process.env.API_CLIENT_ID, process.env.API_CLIENT_SECRET)
      }
    };
    
    const command = new InitiateAuthCommand(apiClientLoginParams);
    const authResult = await cognito.send(command);
    const apiClientJWT = authResult.AuthenticationResult.AccessToken;
    
    // 2. Encrypt password
    const encryptedPassword = encryptPassword(newPassword);
    
    // 3. Call App2 create-user API to create service-user
    const createUserPayload = {
      requesting_user: humanUserId,
      username: newUsername,
      encrypted_password: encryptedPassword
    };
    
    const response = await fetch(process.env.APP2_CREATE_USER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiClientJWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createUserPayload)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(`App2 API error: ${responseData.error}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Service user created successfully via App2',
        username: newUsername,
        app2_response: responseData
      })
    };
    
  } catch (error) {
    console.error('Error creating service user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

function encryptPassword(password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(password);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function calculateSecretHash(username, clientId, clientSecret) {
  return crypto.createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}