# Cross-App Authentication Prototype

A prototype implementation demonstrating secure cross-service authentication using AWS Cognito User Pools, API Gateway, and Lambda functions. This project shows how App1 (user management service) can securely create and manage users in App2 (service app) using JWT-based authentication and encrypted password transmission.

## Project Overview

This prototype implements a service-to-service authentication pattern where:
- **App1**: User management service that creates service users
- **App2**: Service app that processes requests

App1 authenticates with App2 using an API client account, then creates service users that can access App2's protected endpoints. All password transmission between services is encrypted using AES-256-CBC.

## Architecture

### Components

**App1 Stack:**
- Lambda function for calling App2's create-user API
- API Gateway with `/create-service-user` endpoint
- IAM permissions for Cognito authentication

**App2 Stack:**
- Cognito User Pool with two user groups:
  - `api-client`: Can create service users
  - `service-user`: Can access sample processing endpoints
- API Gateway with JWT Token Authorizer
- Lambda functions:
  - JWT Authorizer: Validates tokens and enforces path-based permissions
  - Create User: Creates service users (encrypted password handling)
  - Sample Lambda: Processes service requests

### Authentication Flow

1. App1 receives user creation request with new service user details
2. App1 authenticates with App2 using api-client credentials
3. App1 encrypts the new user's password using AES-256-CBC
4. App1 calls App2's `/admin/create-user` endpoint with encrypted password
5. App2 decrypts password and creates service user in Cognito
6. Service user can now authenticate directly with App2 for processing requests

### Security Features

- JWT-based authentication with path-based authorization
- Encrypted password transmission between services
- Separate user groups with different access levels
- IAM roles with least-privilege permissions
- Temporary password handling with immediate permanent password setting

## When to Use This Pattern

This authentication pattern is suitable when:

- You have multiple microservices that need to create users in other services
- You need encrypted password transmission between services
- You want centralized user management with distributed authentication
- You need fine-grained access control with user groups
- You're building a prototype or POC for cross-service authentication

**Not recommended for:**
- Simple single-service applications
- High-frequency user creation (consider async processing)
- Public-facing user registration (use direct Cognito integration)

## Testing

### Prerequisites

1. Deploy both App1 and App2 stacks using AWS CDK
2. Manually create an api-client user in App2's Cognito User Pool:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <APP2_USER_POOL_ID> \
     --username "app1-api-client" \
     --temporary-password "TempPassword123!" \
     --message-action SUPPRESS
   # NOTE: Above values are EXAMPLES - replace with actual values
   
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <APP2_USER_POOL_ID> \
     --username "app1-api-client" \
     --group-name "api-client"
   
   aws cognito-idp admin-set-user-password \
     --user-pool-id <APP2_USER_POOL_ID> \
     --username "app1-api-client" \
     --password "ProtoPassword123!" \
     --permanent
   # NOTE: Above values are EXAMPLES - replace with actual values
   ```

### Test Create Service User

```bash
# Call App1 to create a service user
curl -X POST https://your-app1-api.amazonaws.com/create-service-user \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test-service-user",
    "password": "ServicePassword123!",
    "human_user_id": "admin@company.com"
  }'
# NOTE: Above values are EXAMPLES - replace with actual values
```

### Test Service User Authentication

```bash
# Authenticate as service user
curl -X POST https://your-app2-api.amazonaws.com/sample \
  -H "Authorization: Bearer <SERVICE_USER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "request_id": "12345",
      "payload": "sample data"
    }
  }'
```

## Production Considerations

### Security Enhancements

1. **Replace Hardcoded Values:**
   - Use AWS Secrets Manager or Parameter Store for API client credentials
   - Generate encryption keys using AWS KMS
   - Remove hardcoded passwords from environment variables

2. **Improve Key Management:**
   ```javascript
   // Instead of hardcoded key
   const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
   
   // Use KMS for encryption
   const kms = new KMSClient({ region: process.env.AWS_REGION });
   const encryptedPassword = await kms.send(new EncryptCommand({
     KeyId: 'alias/cross-app-encryption-key',
     Plaintext: password
   }));
   ```

3. **Enhanced Error Handling:**
   - Implement proper error logging and monitoring
   - Add retry logic for external API calls
   - Use AWS CloudWatch for monitoring and alerting

This prototype provides a solid foundation for understanding cross-service authentication patterns, but requires significant hardening before production deployment.

## CDK Commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template