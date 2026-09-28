const app=require('../server');
const {connectDB}=require('../config/db');
let ready;
module.exports=async(req,res)=>{if(!ready) ready=connectDB(); await ready; return app(req,res)};
