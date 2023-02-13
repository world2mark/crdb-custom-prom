'use strict';



const MyPGModule = require('pg');



const MyPGPool = new MyPGModule.Pool({
    connectionString: process.env.CRDB_CONNSTR,
    ssl: {
        rejectUnauthorized: false
    }
});



const PromClient = require('prom-client')



new PromClient.Gauge({
    name: 'my_total_tables',
    help: 'Count of all user-tables in cluster',
    async collect() {
        const resultSet = await MyPGPool.query(`SELECT count(*) FROM crdb_internal.tables
            WHERE schema_name NOT IN ('pg_catalog','pg_extension','crdb_internal','information_schema')
            AND database_name != 'system' and state != 'DROP';`);
        if (resultSet.rows.length === 0) {
            this.set(0);
        } else {
            this.set(parseInt(resultSet.rows[0].count));
        };
    }
});



new PromClient.Gauge({
    name: 'contention_events',
    help: 'Number of contention events in the database',
    async collect() {
        const resultSet = await MyPGPool.query('select num_contention_events from crdb_internal.cluster_contended_indexes;');
        if (resultSet.rows.length === 0) {
            this.set(0);
        } else {
            this.set(parseInt(resultSet.rows[0].num_contention_events));
        };
    }
});



new PromClient.Counter({
    name: 'test_incrementor',
    help: 'This endpoint increments counter randomly between 1 and 5 when collected',
    async collect() {
        this.inc(1 + Math.trunc(Math.random() * 5));
    }
});



function DefaultHandler(req) {
    const DefaultPage = [];
    DefaultPage.push('<html><body>');
    DefaultPage.push('<p>Server running</p>');
    DefaultPage.push('</body></html>');
    req.MyRes.end(DefaultPage.join(''));
};



function UnknownHandler(req) {
    req.MyRes.statusCode = 301;
    req.MyRes.setHeader('location', '/');
    req.MyRes.end();
};



async function SendMetrics(req) {
    req.MyRes.setHeader('content-type', PromClient.register.contentType);
    req.MyRes.end(await PromClient.register.metrics());
};



function ExtractPostValues(req) {
    return new Promise((resolve, reject) => {
        let body = [];

        req.on('data', data => {
            body.push(data);

            if (body.length > 1e6) {
                // Too much POST data, kill the connection!
                // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
                req.connection.destroy();
                reject();
            };
        });

        req.on('end', () => resolve(body.join()));
    });
};


async function HandleAllRequests(req, res) {
    req.MyURLQuery = new URL(req.url, 'http://localhost:3002');
    req.MyRes = res;

    if (req.method === 'POST') {
        req.MyPostData = await ExtractPostValues(req);
    };

    switch (req.MyURLQuery.pathname) {
        case '/': return DefaultHandler(req);
        case '/metrics': return SendMetrics(req);
        default: return UnknownHandler(req);
    };
};



return new Promise(resolve => {
    const HTTP = require('http');
    const ServerListenerHTTP = HTTP.createServer(HandleAllRequests);
    ServerListenerHTTP.listen(3012, resolve);
}).then(() => {
    console.log('HTTP Server running 3012');
});
