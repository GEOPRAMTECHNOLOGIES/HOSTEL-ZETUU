const mongoose=require('mongoose');
const userSchema=new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxLength:100}, email:{type:String,required:true,lowercase:true,trim:true,index:true}, phone:{type:String,trim:true}, passwordHash:{type:String,required:true},
  role:{type:String,enum:['resident','reception','manager','accountant','owner','platform'],default:'resident'},
  organizationId:{type:mongoose.Schema.Types.ObjectId,index:true}, hostelIds:[mongoose.Schema.Types.ObjectId], emailVerified:{type:Boolean,default:false}, active:{type:Boolean,default:true}, lastLoginAt:Date
},{timestamps:true});
userSchema.index({email:1,organizationId:1},{unique:true,sparse:true});
module.exports=mongoose.model('User',userSchema);
