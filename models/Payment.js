const mongoose=require('mongoose');
const schema=new mongoose.Schema({organizationId:{type:mongoose.Schema.Types.ObjectId,index:true},hostelId:mongoose.Schema.Types.ObjectId,userId:mongoose.Schema.Types.ObjectId,invoiceId:mongoose.Schema.Types.ObjectId,amount:{type:Number,required:true,min:1},method:{type:String,enum:['mpesa','cash','bank','card'],required:true},status:{type:String,enum:['pending','verified','failed','refunded'],default:'pending'},mpesaReceipt:{type:String,index:true,sparse:true},checkoutRequestId:{type:String,index:true,sparse:true},receiptNo:{type:String,unique:true,sparse:true},verifiedAt:Date,metadata:Object},{timestamps:true});
schema.index({checkoutRequestId:1},{unique:true,sparse:true});
schema.index({mpesaReceipt:1},{unique:true,sparse:true});
module.exports=mongoose.model('Payment',schema);
