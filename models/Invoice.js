const mongoose=require('mongoose');
const schema=new mongoose.Schema({number:{type:String,unique:true},hostelId:mongoose.Schema.Types.ObjectId,residentId:mongoose.Schema.Types.ObjectId,description:String,amount:Number,paid:{type:Number,default:0},status:{type:String,enum:['draft','issued','part_paid','paid','overdue','void'],default:'issued'},dueDate:Date},{timestamps:true});
module.exports=mongoose.model('Invoice',schema);
