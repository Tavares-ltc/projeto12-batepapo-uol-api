import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import joi from 'joi'

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

//const mongoClient = new MongoClient(process.env.MONGO_URI)
const mongoClient = new MongoClient("mongodb://localhost:27017");

let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('batepapo');
})

async function isNameAvaliable(name) {
    const someone = await db.collection('participants').findOne({name: name})
    if (someone) {
        return false
    }
    return true
}

app.post("/participants", async (req, res) => {
    
    const userSchema = joi.object({
        name: joi.string().required().empty()
    })
    
    const validation = userSchema.validate(req.body)
    if (validation.error) {
        return res.status(422).send({error: validation.error.message})
    }
    const name = req.body.name

    if (await isNameAvaliable(name)) {
        const data = {
            name,
            lastStatus: Date.now()
        }
        const loginMessage = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}` }
        try {
            await db.collection('participants').insertOne(data)
            await db.collection('messages').insertOne(loginMessage)
            return res.sendStatus(200)

        } catch (error) {
            console.error(error)
            return res.sendStatus(422)
        }
    }
    return res.sendStatus(409)
})

app.get("/participants", async (req, res)=> {
    try {
        const participants = await db.collection('participants').find({}).toArray()
        return res.status(200).send(participants)

    } catch (error) {

        console.log(error)
        return res.sendStatus(400)
    }
    
})

app.post("/messages", async (req, res)=> {
    const messageSchema = joi.object({
        to: joi.string().required().empty(),
        text: joi.string().required().empty(),
        type: joi.required().valid('message', 'private_message')
    })

    const validation = messageSchema.validate(req.body)
    
    if(validation.error) {
        return res.status(422).send({error: validation.error})
    }

    try {
      const someone =  await db.collection('participants').find({name: req.headers.user}).toArray()
      if(someone.length === 0){
        return res.status(404).send('O remetente não existe.')
      }
    } catch (error) {
        console.log(error)
        return res.sendStatus(422)
    }

    const dataMessage = {
        to: req.body.to,
        text: req.body.text,
        type: req.body.type,
        from: req.headers.user,
        time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`
    }

    try {
        await db.collection('messages').insertOne(dataMessage)
        res.sendStatus(201)
    } catch (error) {
        console.log(error)
        res.sendStatus(422)
    }
})

app.get('/messages', async (req, res)=> {
    const limit = Number(req.query.limit)
    const user = req.headers.user
    try {
        const messages = await db.collection('messages').find({$or: [{type: "message"}, {type: "status"}, {to: user}, {from: user}]}).sort({_id: 1}).limit(limit).toArray()
        res.send(messages)
    } catch (error) {
        console.log(error)
        res.send('Algo deu errado.')
    }
})

app.post('/status', async (req, res)=> {
const user = req.headers.user;

if(await isNameAvaliable(user)){
    return res.sendStatus(404)
}

try {
   await db.collection('participants').updateOne({name: user},
        {
            $set: {
                lastStatus: Date.now()
            }
        })
    res.sendStatus(200)
    
} catch (error) {
    console.log(error)
    res.sendStatus(404)
}
    
})

app.delete('/messages/:id', async (req, res)=> {
    const id_message  = req.params.id
    console.log('é')
    let message
    try {
        console.log(id_message)
        message = await db.collection('messages').findOne({_id: ObjectId(id_message)})
              res.sendStatus(200)
    } catch (error) {
        console.log(error)
        return res.sendStatus(404)
    }
    if(message.from === req.headers.user){
        await db.collection('messages').deleteOne({_id: ObjectId(id_message)})    
    }
    else {
        return res.sendStatus(401)
    }
})

setInterval(async ()=> {
    const minimum = (Date.now()) - 10000
    const offlineUsers= await db.collection('participants').find({lastStatus: {$lt: minimum}}).toArray()
    offlineUsers.forEach(async (user)=>{
        const logoutMessage = {from: user.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`}
        try {
            await db.collection('participants').deleteOne({_id: user._id})
            await db.collection('messages').insertOne(logoutMessage)
        } catch (error) {
            console.log(error)
            res.sendStatus(404)
        }
    })
}, 15000)

app.listen(5000, () => {
    console.log('listen on port 5000')
})
