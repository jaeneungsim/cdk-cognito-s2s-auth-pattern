exports.handler = async (event) => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // User information from JWT Authorizer
    const requestContext = event.requestContext;
    const authorizer = requestContext.authorizer;
    
    const body = JSON.parse(event.body || '{}');
    const reportData = body.report_data;
    
    console.log('Authorizer context:', authorizer);
    console.log('Report data:', reportData);
    
    // Verify service-user group
    const userGroups = JSON.parse(authorizer.groups || '[]');
    if (!userGroups.includes('service-user')) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Forbidden: service-user group required'
        })
      };
    }
    
    // Process sample address validation error report
    const processedReport = {
      report_id: `report-${Date.now()}`,
      processed_at: new Date().toISOString(),
      processed_by: authorizer.username,
      user_id: authorizer.userId,
      status: 'processed',
      original_data: reportData,
      validation_results: {
        address_valid: Math.random() > 0.5,
        error_count: Math.floor(Math.random() * 10),
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
      }
    };
    
    // In production, save to DynamoDB or other database here
    console.log('Processed report:', processedReport);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Address validation report processed successfully',
        report: processedReport
      })
    };
    
  } catch (error) {
    console.error('Error processing report:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};