import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { App2Stack } from './app2-stack';
import { App1Stack } from './app1-stack';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create App2 stack first
    const app2Stack = new App2Stack(scope, 'App2Stack', props);

    // 2. Create App1 stack with App2 references
    const app1Stack = new App1Stack(scope, 'App1Stack', {
      ...props,
      app2ApiUrl: app2Stack.apiGateway.url,
      app2UserPoolId: app2Stack.userPool.userPoolId,
      app2ApiClientId: app2Stack.apiClientAppClient.userPoolClientId,
      // PROTOTYPE: Replace with actual client secret from AWS Console after first deployment
      // Go to Cognito -> User pools -> app2-user-pool -> App clients -> api-client-app-client
      app2ApiClientSecret: 'REPLACE_WITH_ACTUAL_CLIENT_SECRET' // EXAMPLE: Replace with actual secret
    });

    // 3. Set stack dependencies
    app1Stack.addDependency(app2Stack);

    // 4. Combined outputs
    new cdk.CfnOutput(this, 'DeploymentSummary', {
      value: JSON.stringify({
        app1_api: app1Stack.apiGateway.url,
        app2_api: app2Stack.apiGateway.url,
        user_pool_id: app2Stack.userPool.userPoolId
      }),
      description: 'Deployment Summary'
    });
  }
}
