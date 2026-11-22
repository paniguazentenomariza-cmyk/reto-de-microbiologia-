const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const app = express(), server = http.createServer(app), io = new Server(server);
app.use(express.static("public"));
// El archivo index.html está en la raíz del repositorio.
app.get("/", (req, res) => res.sendFile(require("path").join(__dirname, "index.html")));
const rooms = new Map();
const bank = [
["¿Qué instrumento permite observar microorganismos que no se ven a simple vista?","Microscopio","Telescopio","Brújula","Termómetro",0,"Microscopía"],
["¿Cuál de estos microorganismos es una bacteria?","Escherichia coli","Mariposa","Pino","Lombriz",0,"Bacterias"],
["¿Qué estructura protege el material genético de muchos virus?","Cápside","Raíz","Cloroplasto","Pétalo",0,"Virus"],
["¿Qué organismos son unicelulares y pertenecen al reino de los hongos?","Levaduras","Helechos","Peces","Arácnidos",0,"Hongos"],
["¿Qué se utiliza para reducir microorganismos en superficies?","Desinfección","Fotosíntesis","Polinización","Fermentación",0,"Prevención"],
["¿Qué forma tienen los cocos bacterianos?","Esférica","Espiral","Alargada","Estrellada",0,"Morfología"],
["¿Qué necesitan muchos microorganismos para crecer?","Condiciones adecuadas","Luz de luna","Metal sólido","Arena seca siempre",0,"Cultivo"],
["¿Qué significa que un microorganismo sea patógeno?","Que puede causar enfermedad","Que siempre es beneficioso","Que no tiene células","Que es una planta",0,"Salud"],
["¿Cuál es una medida básica para prevenir infecciones?","Lavarse las manos","Compartir utensilios sin limpiar","Evitar ventilar","No limpiar superficies",0,"Prevención"],
["¿Qué tipo de célula no tiene núcleo definido?","Procariota","Eucariota","Animal","Vegetal",0,"Células"]
].map((q,i)=>({text:q[0],options:q.slice(1,5),correct:q[5],image:q[6]}));
function code(){return crypto.randomBytes(3).toString("hex").toUpperCase()}
function roomData(r){return {code:r.code,red:r.players.filter(p=>p.team==="red").map(p=>p.name),blue:r.players.filter(p=>p.team==="blue").map(p=>p.name),playerCount:r.players.length,spectatorCount:r.spectators.length,started:r.started}}
function update(r){io.to(r.code).emit("roomUpdate",roomData(r))}
function sendQuestion(r){if(r.index>=r.questions.length){r.started=false;let winner=r.red>=r.blue?"Equipo rojo": "Equipo azul";io.to(r.code).emit("finished",{winner,red:r.red,blue:r.blue});return}
const q=r.questions[r.index];io.to(r.code).emit("question",{number:r.index+1,text:q.text,options:q.options,image:q.image,seconds:10});
let n=10;clearInterval(r.clock);r.clock=setInterval(()=>{n--;io.to(r.code).emit("tick",n);if(n<=0){clearInterval(r.clock);io.to(r.code).emit("answerResult",{message:"Tiempo terminado. La respuesta correcta era "+q.options[q.correct]});setTimeout(()=>{r.index++;sendQuestion(r)},2000)}},1000)}
io.on("connection",s=>{
s.on("createRoom",({name})=>{let c=code();while(rooms.has(c))c=code();let r={code:c,host:s.id,players:[{id:s.id,name,team:"red"}],spectators:[],started:false,index:0,red:0,blue:0,questions:[...bank].sort(()=>Math.random()-.5).slice(0,10),answers:new Set()};rooms.set(c,r);s.join(c);s.data.room=c;s.data.role="host";s.emit("roomCreated",{code:c});update(r)});
s.on("joinRoom",({code,name,role})=>{let r=rooms.get((code||"").toUpperCase());if(!r)return s.emit("errorMsg","No encontramos esa sala. Revisa el código.");if(r.started)return s.emit("errorMsg","El concurso ya comenzó.");if(role==="spectator"){if(r.spectators.length>=2)return s.emit("errorMsg","La sala ya tiene 2 espectadores.");r.spectators.push({id:s.id,name});s.data.role="spectator"}else{if(r.players.length>=6)return s.emit("errorMsg","La sala ya tiene 6 jugadores.");let team=r.players.filter(p=>p.team==="red").length<=r.players.filter(p=>p.team==="blue").length?"red":"blue";r.players.push({id:s.id,name,team});s.data.role="player"}s.join(r.code);s.data.room=r.code;s.emit("joined",{code:r.code});update(r)});
s.on("startGame",({code})=>{let r=rooms.get(code);if(!r||r.host!==s.id)return;if(r.players.length<2)return s.emit("errorMsg","Necesitan al menos 2 jugadores para comenzar la prueba.");r.started=true;r.index=0;sendQuestion(r);update(r)});
s.on("answer",({code,index})=>{let r=rooms.get(code);if(!r||!r.started||s.data.role!=="player"||r.answers.has(s.id))return;let q=r.questions[r.index],p=r.players.find(x=>x.id===s.id);if(!p)return;r.answers.add(s.id);if(index===q.correct){if(p.team==="red")r.red+=100;else r.blue+=100;io.to(r.code).emit("answerResult",{message:"¡Respuesta correcta! +100 puntos."})}else s.emit("answerResult",{message:"Respuesta incorrecta. ¡Sigue intentando!"});io.to(r.code).emit("score",{red:r.red,blue:r.blue});if(r.answers.size>=r.players.length){clearInterval(r.clock);io.to(r.code).emit("answerResult",{message:"Todos respondieron. Siguiente pregunta…"});r.answers.clear();setTimeout(()=>{r.index++;sendQuestion(r)},2000)}});
s.on("disconnect",()=>{let r=rooms.get(s.data.room);if(!r)return;r.players=r.players.filter(p=>p.id!==s.id);r.spectators=r.spectators.filter(p=>p.id!==s.id);if(!r.players.length){clearInterval(r.clock);rooms.delete(r.code)}else update(r)});
});
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log("RETO DE MICROBIOLOGÍA activo en puerto "+PORT));
