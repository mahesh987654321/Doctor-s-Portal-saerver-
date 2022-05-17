const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
app.use(cors());
require("dotenv").config();
app.use(express.json());
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.ADD_USER}:${process.env.ADD_PASS}@cluster0.eqxbe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// const uri = `mongodb+srv://doctor:n1E4DcFlSCvmf4Iw@cluster0.eqxbe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctor").collection("center");
    const bookingCollection = client.db("doctor").collection("booking");
    const userCollections = client.db("doctor").collection("user");

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;

      const user = req.body;
      console.log("User is ", user);
      const filter = { email: email };

      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, {
        expiresIn: "10d",
      });
      res.send({ result, token });
    });
    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requestUser = req.decoded.email;
      console.log(requestUser);
      const requestEmail = await userCollections.findOne({
        email: requestUser,
      });
      if (requestEmail.role === "admin") {
        const filter = { email: email };

        const options = { upsert: true };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollections.updateOne(
          filter,
          updateDoc,
          options
        );

        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    });
    function verifyJWT(req, res, next) {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).send({ message: "Unauthorize Access" });
      }
      const token = authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
      });
    }
app.get('/admin/:email',async(req,res)=>{
  const email = req.params.email
  const user = await userCollections.findOne({email:email})
  const isAdmin = user.role === 'admin'
  res.send({admin:isAdmin})
})
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    });

    app.get("/booking", verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === patient) {
        const authorization = req.headers.authorization;
        console.log("AuthHeader------->>>>>", authorization);

        const query = { patient: patient };

        const booking = await bookingCollection.find(query).toArray();

        res.send(booking);
      } else {
        return res.status(403).status({ message: "Forbidden access booking" });
      }
    });
    app.get("/service", async (req, res) => {
      const query = {};

      const select = serviceCollection.find(query);
      const result = await select.toArray();
      res.send(result);
    });
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        selected: booking.selected,
        patient: booking.patient,
      };

      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    app.get("/available", async (req, res) => {
      const selected = req.query.selected;

      const services = await serviceCollection.find().toArray();

      const query = { selected: selected };

      const booking = await bookingCollection.find(query).toArray();
      services.forEach((service) => {
        const serviceBooking = booking.filter(
          (b) => b.treatment === service.name
        );
        // console.log(serviceBooking);
        const booked = serviceBooking.map((s) => {
          s.slots;
        });
        const available = service.slots.filter(
          (slot) => !booked.includes(slot)
        );
        service.slots = available;
        // console.log(service.slots);
      });
      res.send(services);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
