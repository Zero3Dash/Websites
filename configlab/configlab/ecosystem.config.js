module.exports = {
    apps: [{
        name: 'configlab-app',
        script: 'server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: '/var/log/configlab/err.log',
        out_file: '/var/log/configlab/out.log',
        log_file: '/var/log/configlab/combined.log',
        time: true
    }]
};