import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
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
        console.log('ja tem')
        return false
    }
    console.log('não tem')
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
        type: joi.string().required() //type só pode ser 'message' ou 'private_message'
    })

    const validation = messageSchema.validate(req.body)
    
    if(validation.error) {
        return res.status(422).send({error: validation.error})
    }

    try {
      const someone =  await db.collection('participants').find({name: req.headers.user}).toArray()
      console.log(someone)
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
        const messages = await db.collection('messages').find({$or: [{type: "message"}, {to: user}, {from: user}]}).sort({_id:-1}).limit(limit).toArray()
        res.send(messages)
    } catch (error) {
        console.log(error)
        res.send('Algo deu errado.')
    }
    
})

app.listen(5000, () => {
    console.log('listen on port 5000')
})
