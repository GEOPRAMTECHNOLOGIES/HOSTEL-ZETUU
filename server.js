require('dotenv').config(); const path=require('path'); const express=require('express'); const helmet=require('helmet'); const cors=require('cors'); const compression=require('compression'); const cookieParser=require('cookie-parser'); const mongoSanitize=require('express-mongo-sanitize'); const hpp=require('hpp'); const {connectDB}=require('./config/db'); require('./config/env')(); const {apiLimiter}=require('./middleware/limiter');
const app=express(); app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"]}},crossOriginEmbedderPolicy:false}));
app.use(cors({origin:process.env.CLIENT_URL||true,credentials:true})); app.use(compression()); app.use(express.json({limit:'1mb'})); app.use(cookieParser(process.env.COOKIE_SECRET)); app.use(mongoSanitize()); app.use(hpp()); app.use('/api',apiLimiter);
app.use('/api/auth',require('./routes/auth')); app.use('/api/app',require('./routes/app')); app.use('/api/mpesa',require('./routes/mpesa')); app.use('/api/system',require('./routes/system'));
app.use(express.static(path.join(__dirname,'public'),{maxAge:process.env.NODE_ENV==='production'?'1d':0,setHeaders:(res,p)=>{if(p.endsWith('.html'))res.setHeader('Cache-Control','no-store')}}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
module.exports=app;
if(require.main===module){ const port=process.env.PORT||3000; connectDB().then(()=>app.listen(port,()=>console.log(`Hosteli Zetu listening on ${port}`))).catch(err=>{console.error(err);process.exit(1)}); }
