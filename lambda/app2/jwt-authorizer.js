const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: process.env.JWKS_URI
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

exports.handler = async (event) => {
  try {
    const token = event.authorizationToken?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });

    const userGroups = decoded['cognito:groups'] || [];
    const clientId = decoded.client_id;
    const path = event.methodArn;

    // Path-based permission check
    if (path.includes('/admin/create-user')) {
      // Only api-client group can access (for creating service-users)
      if (userGroups.includes('api-client')) {
        return generatePolicy('Allow', event.methodArn, decoded);
      }
    } else if (path.includes('/sample')) {
      // Only service-user group can access (for actual service usage)
      if (userGroups.includes('service-user')) {
        return generatePolicy('Allow', event.methodArn, decoded);
      }
    }

    return generatePolicy('Deny', event.methodArn, decoded);
    
  } catch (error) {
    console.error('Authorization error:', error);
    return generatePolicy('Deny', event.methodArn, {});
  }
};

function generatePolicy(effect, resource, context) {
  return {
    principalId: context.sub || 'unknown',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context: {
      userId: context.sub || '',
      username: context.username || '',
      groups: JSON.stringify(context['cognito:groups'] || []),
      clientId: context.client_id || ''
    }
  };
}