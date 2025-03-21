module.exports = {
    apps: [{
      name: 'insurance-app',
      script: 'app.js',
      autorestart: true,
      watch: false,
      time: true,
      env: {
        NODE_ENV: 'production'
      }
    }]
  };