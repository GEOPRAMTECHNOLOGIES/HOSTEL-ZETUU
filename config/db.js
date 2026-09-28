const mongoose = require('mongoose');
let promise;
async function connectDB(){
  if(mongoose.connection.readyState===1) return mongoose.connection;
  if(!promise) promise=mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000,maxPoolSize:10});
  await promise; return mongoose.connection;
}
module.exports={connectDB};
