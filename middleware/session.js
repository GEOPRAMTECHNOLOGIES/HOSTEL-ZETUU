const jwt=require('jsonwebtoken');const User=require('../models/User');
async function requireSession(req,res,next){try{const token=req.cookies.hz_session||req.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({message:'Authentication required'});const p=jwt.verify(token,process.env.JWT_SECRET);const user=await User.findById(p.sub).select('-password');if(!user||user.status!=='active')return res.status(401).json({message:'Session is no longer valid'});req.user=user;next()}catch(e){return res.status(401).json({message:'Authentication required'})}}
function allow(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({message:'This action is not permitted for your role'});}
module.exports={requireSession,allow};
