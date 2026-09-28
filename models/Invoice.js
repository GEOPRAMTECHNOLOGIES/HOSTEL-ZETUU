const mongoose=require('mongoose');
const schema=new mongoose.Schema({organizationId:mongoose.Schema.Types.ObjectId,hostelId:mongoose.Schema.Types.ObjectId,userId:mongoose.Schema.Types.ObjectId,description:String,amount:{type:Number,min:0},paidAmount:{type:Number,default:0},status:{type:String,enum:['unpaid','partial','paid','void'],default:'unpaid'},dueDate:Date},{timestamps:true});
module.exports=mongoose.model('Invoice',schema);
