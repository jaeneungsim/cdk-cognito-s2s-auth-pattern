import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class App2Stack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly apiClientAppClient: cognito.UserPoolClient;
  public readonly serviceAppClient: cognito.UserPoolClient;
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'App2UserPool', {
      userPoolName: 'app2-user-pool',
      signInAliases: {
        username: true,
        email: false
      },
      autoVerify: {
        email: false
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1) // Temporary password valid for 1 day
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // 2. Create User Groups
    const apiClientGroup = new cognito.CfnUserPoolGroup(this, 'ApiClientGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'api-client',
      description: 'API clients that can create service users'
    });

    const serviceUserGroup = new cognito.CfnUserPoolGroup(this, 'ServiceUserGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'service-user',
      description: 'Service users that can call sample lambda'
    });

    // 3. Create App Clients
    this.apiClientAppClient = this.userPool.addClient('ApiClientAppClient', {
      userPoolClientName: 'api-client-app-client',
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      generateSecret: true
    });

    this.serviceAppClient = this.userPool.addClient('ServiceAppClient', {
      userPoolClientName: 'service-app-client',
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      generateSecret: true
    });

    // 4. Create Lambda Functions
    const jwtAuthorizerLambda = new lambda.Function(this, 'JwtAuthorizerLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'jwt-authorizer.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/app2')),
      environment: {
        JWKS_URI: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}/.well-known/jwks.json`
      }
    });

    const createUserLambda = new lambda.Function(this, 'CreateUserLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'create-user.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/app2')),
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        // PROTOTYPE: Replace with your 32-character encryption key
        ENCRYPTION_KEY: 'prototype-key-32-chars-long1234!' // EXAMPLE: Replace with actual key
      }
    });

    const sampleLambda = new lambda.Function(this, 'SampleLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'sample-lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/app2'))
    });

    // 5. Set IAM permissions
    createUserLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminSetUserPassword'
      ],
      resources: [this.userPool.userPoolArn]
    }));

    // 6. Manual user creation required after deployment
    // Create user manually in Cognito console:
    // Username: app1-api-client // EXAMPLE: Replace with actual username
    // Password: ProtoPassword123! // EXAMPLE: Replace with actual password
    // Group: api-client

    // 7. Create API Gateway
    this.apiGateway = new apigateway.RestApi(this, 'App2Api', {
      restApiName: 'app2-api',
      description: 'API for App2 address validation service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      }
    });

    // 8. Configure JWT Authorizer
    const authorizer = new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
      handler: jwtAuthorizerLambda,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.seconds(300)
    });

    // 9. Set up API Gateway endpoints
    // /sample endpoint (for service-user group)
    const sampleResource = this.apiGateway.root.addResource('sample');
    sampleResource.addMethod('POST', new apigateway.LambdaIntegration(sampleLambda), {
      authorizer: authorizer
    });

    // /admin/create-user endpoint (for api-client group)
    const adminResource = this.apiGateway.root.addResource('admin');
    const createUserResource = adminResource.addResource('create-user');
    createUserResource.addMethod('POST', new apigateway.LambdaIntegration(createUserLambda), {
      authorizer: authorizer
    });

    // 10. Configure outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'User Pool ID'
    });

    new cdk.CfnOutput(this, 'ApiClientAppClientId', {
      value: this.apiClientAppClient.userPoolClientId,
      description: 'API Client App Client ID'
    });

    new cdk.CfnOutput(this, 'ServiceAppClientId', {
      value: this.serviceAppClient.userPoolClientId,
      description: 'Service App Client ID'
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiGateway.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'CreateUserEndpoint', {
      value: `${this.apiGateway.url}admin/create-user`,
      description: 'Create User Endpoint URL (for api-client group)'
    });

    new cdk.CfnOutput(this, 'SampleEndpoint', {
      value: `${this.apiGateway.url}sample`,
      description: 'Sample Lambda Endpoint URL (for service-user group)'
    });

    new cdk.CfnOutput(this, 'ManualSetupInstructions', {
      value: 'Create user manually: Username=app1-api-client (EXAMPLE), Password=ProtoPassword123! (EXAMPLE), Group=api-client',
      description: 'Manual user creation required after deployment'
    });
  }
}