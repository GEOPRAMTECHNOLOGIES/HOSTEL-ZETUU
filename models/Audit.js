const mongoose=require('mongoose');
const schema=new mongoose.Schema({organizationId:mongoose.Schema.Types.ObjectId,userId:mongoose.Schema.Types.ObjectId,action:String,resource:String,resourceId:String,ip:String,meta:Object},{timestamps:true});
module.exports=mongoose.model('Audit',schema);
