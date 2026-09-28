const mongoose=require('mongoose');
const schema=new mongoose.Schema({organizationId:{type:mongoose.Schema.Types.ObjectId,index:true},name:{type:String,required:true},location:String,ownerId:mongoose.Schema.Types.ObjectId,status:{type:String,enum:['active','archived'],default:'active'},beds:{type:Number,default:0},occupiedBeds:{type:Number,default:0}},{timestamps:true});
module.exports=mongoose.model('Hostel',schema);
