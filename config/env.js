const required = ['MONGO_URI','JWT_SECRET','COOKIE_SECRET'];
module.exports = function validateEnv(){
  const missing = required.filter(k=>!process.env[k]);
  if(missing.length && process.env.NODE_ENV==='production') throw new Error(`Missing environment variables: ${missing.join(', ')}`);
};
