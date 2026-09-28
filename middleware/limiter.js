const rateLimit=require('express-rate-limit');
exports.authLimiter=rateLimit({windowMs:15*60*1000,max:12,standardHeaders:true,legacyHeaders:false});
exports.apiLimiter=rateLimit({windowMs:60*1000,max:180,standardHeaders:true,legacyHeaders:false});
