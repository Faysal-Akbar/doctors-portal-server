const express = require('express')
const app = express()
const cors = require('cors');
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config();
const port = process.env.PORT || 5000;

//Middleware
app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rqp1u.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];
    try{
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    }
    catch{

    }
  }
  next();
}

async function run(){
    try{
        await client.connect()
        const database = client.db("doctors_portal");
        const appointmentsCollection = database.collection("appointments");
        const usersCollection = database.collection("users");

        //GET API
        app.get('/appointments', verifyToken, async(req, res) => {
          const email = req.query.email;
          const date = new Date(req.query.date).toDateString();
          const query = {email: email, date: date}
          const cursor = appointmentsCollection.find(query);
          const result = await cursor.toArray();
          res.send(result);
        })

        //POST API
        app.post('/appointments', async(req, res) => {
          const appointment = req.body;
          const result = await appointmentsCollection.insertOne(appointment);
          res.json(result);
        })
        
        // isAdmin, true or false
        app.get('/users/:email', async(req, res) => {
          const email = req.params.email;
          const query = {email: email};
          const result = await usersCollection.findOne(query);
          let isAdmin = false;
          if(result?.role === 'admin'){
            isAdmin = true;
          }
          res.send({admin: isAdmin})
        })

        app.post('/users', async(req, res) => {
          const user = req.body;
          const result = await usersCollection.insertOne(user);
          res.send(result);
        });

        app.put('/users', async(req, res) => {
          const user = req.body;
          const filter = {email: user.email};
          const options = { upsert: true };
          const updateDoc = {$set: user};
          const result = await usersCollection.updateOne(filter, updateDoc, options);
          res.json(result);
        });

        // make admin
        app.put('/users/admin', verifyToken, async(req, res) => {
          const user = req.body;
          const requester = req.decodedEmail;
          if(requester){
            const requesterAccount = await usersCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin'){
              const filter = {email: user.email};
              const updateDoc = { $set: {role: 'admin'}}
              const result = await usersCollection.updateOne(filter, updateDoc);
              res.json(result);
            }
            else{
              res.send(403).json({message: 'You do not have access to make admin'})
            }
          }
        })
    }
    finally{
        // await client.close();
    }

}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Doctors Portal!');
})

app.listen(port, () => {
  console.log(`Listening at ${port}`);
})