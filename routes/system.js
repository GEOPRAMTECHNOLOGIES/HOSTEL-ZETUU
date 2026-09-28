const router=require('express').Router(); const mongoose=require('mongoose');
router.get('/health',async(req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({ok:mongoose.connection.readyState===1}));
module.exports=router;
