import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface App1StackProps extends cdk.StackProps {
  app2ApiUrl: string;
  app2UserPoolId: string;
  app2ApiClientId: string;
  app2ApiClientSecret: string;
}

export class App1Stack extends cdk.Stack {
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: App1StackProps) {
    super(scope, id, props);

    // 1. Create Lambda Function
    const createUserClientLambda = new lambda.Function(this, 'CreateUserClientLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'create-user-client.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/app1')),
      environment: {
        // App2 connection information
        APP2_CREATE_USER_URL: `${props.app2ApiUrl}admin/create-user`,
        APP2_USER_POOL_ID: props.app2UserPoolId,
        
        // PROTOTYPE: API Client information (user in App2 api-client group)
        // Replace these values with your actual credentials
        API_CLIENT_ID: props.app2ApiClientId,
        API_CLIENT_SECRET: props.app2ApiClientSecret,
        API_CLIENT_USERNAME: 'app1-api-client', // EXAMPLE: Auto-created by App2 stack
        API_CLIENT_PASSWORD: 'ProtoPassword123!', // EXAMPLE: Replace with actual password
        
        // PROTOTYPE: Replace with your 32-character encryption key
        ENCRYPTION_KEY: 'prototype-key-32-chars-long1234!' // EXAMPLE: Replace with actual key
      },
      timeout: cdk.Duration.seconds(30)
    });

    // 2. Set IAM permissions for App2 Cognito calls
    createUserClientLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:InitiateAuth'
      ],
      resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${props.app2UserPoolId}`]
    }));

    // 3. Create API Gateway
    this.apiGateway = new apigateway.RestApi(this, 'App1Api', {
      restApiName: 'app1-api',
      description: 'API for App1 user management service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization']
      }
    });

    // 4. Set up API Gateway endpoints
    // create-service-user endpoint
    const createServiceUserResource = this.apiGateway.root.addResource('create-service-user');
    createServiceUserResource.addMethod('POST', new apigateway.LambdaIntegration(createUserClientLambda));

    // 5. Configure outputs
    new cdk.CfnOutput(this, 'App1ApiGatewayUrl', {
      value: this.apiGateway.url,
      description: 'App1 API Gateway URL'
    });

    new cdk.CfnOutput(this, 'CreateServiceUserEndpoint', {
      value: `${this.apiGateway.url}create-service-user`,
      description: 'Create Service User Endpoint URL'
    });

    new cdk.CfnOutput(this, 'SetupInstructions', {
      value: 'After deployment, manually create an api-client user in App2 Cognito with username: app1-api-client',
      description: 'Manual Setup Required'
    });
  }
}