module.exports=(err,req,res,next)=>{console.error(err);res.status(err.status||500).json({error:process.env.NODE_ENV==='production'?'SERVER_ERROR':err.message});};
