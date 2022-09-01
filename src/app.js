import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
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

app.post("/participants", async (req, res) => {
    try {
        db.collection('participants').insertOne(req.body)
        res.sendStatus(200)

    } catch (error) {
        console.error(error)
        res.sendStatus(422)
    }

})


app.listen(5000, () => {
    console.log('listen on port 5000')
})
