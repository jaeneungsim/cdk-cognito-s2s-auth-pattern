const { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminSetUserPasswordCommand 
} = require('@aws-sdk/client-cognito-identity-provider');
const crypto = require('crypto');

const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

// PROTOTYPE: Replace with your 32-character encryption key
// In production, use KMS or Secrets Manager
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'prototype-key-32-chars-long1234!'; // EXAMPLE: Replace with actual key

exports.handler = async (event) => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // User information from JWT Authorizer
    const requestContext = event.requestContext;
    const authorizer = requestContext.authorizer;
    
    // Actual requesting user information from request body
    const body = JSON.parse(event.body || '{}');
    const requestingUser = body.requesting_user;
    const encryptedPassword = body.encrypted_password;
    const username = body.username;
    
    console.log('Requesting user:', requestingUser);
    console.log('Username:', username);
    console.log('Authorizer context:', authorizer);
    
    // Verify api-client group
    const userGroups = JSON.parse(authorizer.groups || '[]');
    if (!userGroups.includes('api-client')) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Forbidden: api-client group required'
        })
      };
    }
    
    // Check required parameters
    if (!username || !encryptedPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required parameters: username, encrypted_password'
        })
      };
    }
    
    // Decrypt password
    const decryptedPassword = decryptPassword(encryptedPassword);
    
    // Create new Service User
    const createUserParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: username,
      TemporaryPassword: decryptedPassword,
      MessageAction: 'SUPPRESS' // No email sending
    };
    
    // Create user
    const createCommand = new AdminCreateUserCommand(createUserParams);
    await cognito.send(createCommand);
    
    // Add to service-user group
    const addToGroupParams = {
      GroupName: 'service-user',
      UserPoolId: process.env.USER_POOL_ID,
      Username: username
    };
    
    const addToGroupCommand = new AdminAddUserToGroupCommand(addToGroupParams);
    await cognito.send(addToGroupCommand);
    
    // Set permanent password (using decrypted password)
    const setPasswordParams = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: username,
      Password: decryptedPassword,
      Permanent: true
    };
    
    const setPasswordCommand = new AdminSetUserPasswordCommand(setPasswordParams);
    await cognito.send(setPasswordCommand);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Service user created successfully',
        username: username,
        group: 'service-user',
        created_by: requestingUser,
        created_at: new Date().toISOString()
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

function decryptPassword(encryptedPassword) {
  try {
    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    throw new Error('Failed to decrypt password: ' + error.message);
  }
}