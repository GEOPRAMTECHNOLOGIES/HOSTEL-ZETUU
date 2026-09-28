const jwt=require('jsonwebtoken');
const User=require('../models/User');
const Audit=require('../models/Audit');
function signAccess(user){return jwt.sign({sub:user._id.toString(),role:user.role,org:user.organizationId?.toString()},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'15m'});}
async function auth(req,res,next){
 try{const token=req.signedCookies?.hz_session || req.cookies?.hz_session || (req.headers.authorization||'').replace(/^Bearer\s+/i,''); if(!token) return res.status(401).json({error:'AUTH_REQUIRED'}); const p=jwt.verify(token,process.env.JWT_SECRET); const user=await User.findById(p.sub).lean(); if(!user||!user.active) return res.status(401).json({error:'SESSION_INVALID'}); req.user=user; next();}catch(e){return res.status(401).json({error:'SESSION_INVALID'});}}
function allow(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'FORBIDDEN'});}
function orgScope(req, query={}){ if(req.user.role==='platform') return query; return {...query,organizationId:req.user.organizationId}; }
async function audit(req,action,resource,resourceId,meta={}){try{await Audit.create({organizationId:req.user.organizationId,userId:req.user._id,action,resource,resourceId:String(resourceId||''),ip:req.ip,meta});}catch{}}
module.exports={signAccess,auth,allow,orgScope,audit};
