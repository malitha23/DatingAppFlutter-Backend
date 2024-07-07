

// Define the task to be executed
const checkAndUpdateStatus = () => {
    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = `
        UPDATE packagesbuydata
        SET payment_status = CASE WHEN packageStartEnd < '${currentDate}' THEN 0 ELSE payment_status END
        WHERE packageStartEnd < '${currentDate}' AND payment_status = 1
    `;
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error updating payment status:', error);
        } else {
            console.log(`Updated ${results.affectedRows} rows.`);
        }
    });
};

// Schedule task to run every hour (adjust as needed)
cron.schedule('0 * * * *', () => {
    console.log('Running task...');
    checkAndUpdateStatus();
});

// Initial check when the application starts
checkAndUpdateStatus();

// Handle application shutdown gracefully
process.on('SIGINT', () => {
    console.log('Closing MySQL connection and stopping scheduler...');
    connection.end();
    process.exit();
});
