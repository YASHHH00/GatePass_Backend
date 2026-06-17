require('dotenv').config();
const app = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 5000;

app.listen(PORT, () => {
  console.log(`🚀 NTPC Gate Pass API server running on port ${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
