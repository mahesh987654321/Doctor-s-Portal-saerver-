const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
app.use(cors());

require("dotenv").config();
app.use(express.json());
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.ADD_USER}:${process.env.ADD_PASS}@cluster0.eqxbe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// const uri = `mongodb+srv://doctor:n1E4DcFlSCvmf4Iw@cluster0.eqxbe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const stripe = require("stripe")(
  "sk_test_51L0pZ4AUO7tB19c8oeJMRIBsEyK4FenpjbgbJU0jwb7mup0FHWAYE1nxfFlHNjV8g2pM8TTkITXVcbGFG2IFh6x900UHEh6PO4"
);

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
    const doctorsCollections = client.db("doctor").collection("doctors");

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
    const verifyAdmin = async (req, res, next) => {
      const requestUser = req.decoded.email;

      const requestEmail = await userCollections.findOne({
        email: requestUser,
      });
      if (requestEmail.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    };
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

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
    });
    // Stripe sector
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(paymentIntent);
      res.send({ clientSecret: paymentIntent.client_secret });
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

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollections.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    });
    app.get("/doctors", async (req, res) => {
      const result = await doctorsCollections.find().toArray();
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

      const select = serviceCollection.find(query).project({ name: 1 });
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
    app.post("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;

      const result = await doctorsCollections.insertOne(doctor);
      res.send(result);
    });
    app.delete("/doctors/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const filter = { email: email };
      console.log(filter);
      const result = await doctorsCollections.deleteOne(filter);
      res.send(result);
    });
    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
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
