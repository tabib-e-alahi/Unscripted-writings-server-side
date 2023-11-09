const express = require("express");
const cors = require("cors");
// const jwt = require('jsonwebtoken')
// const cookieParser = require('cookie-parser')
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());
// app.use(cookieParser())

// console.log(process.env.DB_User);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.o8c7bsg.mongodb.net/?retryWrites=true&w=majority`;
// console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



// const logger = (req, res, next) =>{
//   console.log('log: info ', req.method, req.url);
//   next();
// }

// const verifyToken = (req, res, next) =>{
//   const token = req?.cookies?.token;
//   console.log('In the middleware : ', token);

//   if(!token){
//     return res.status(401).send({message: 'unauthorized access'});
//   }

//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err,decoded) =>{
//     if(err){
//       return res.status(401).send({message: 'unauthorized access'});
//     }
//     req.use = decoded;
//     next()
//   })
// }




async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const blogCollection = client.db("blogsDB").collection("blogs");
    const wishlistCollection = client.db("blogsDB").collection("wishlist");
    const commentCollection = client.db("blogsDB").collection("comments");


// //  auth api related============
// app.post('/jwt',logger, async(req,res) =>{
//   const user = req.body;
//   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1hr'})

//   res.cookie('token',token,{
//     httpOnly:true,
//     secure:true,
//     sameSite:'none'
//   })
//   .send({success: true})

// })

// app.post('/logout', async(req,res) =>{
//   const user = req.body;
//   console.log('Form logout api',user);
//   res.clearCookie('token',{maxAge: 0}).send({success: true})

// })



    // data related api===========
    app.get("/blog", async (req, res) => {
      const cursor = blogCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/blog/recent", async (req, res) => {
      const cursor = blogCollection.find();
      const result = await cursor.toArray();

      result.forEach((entry) => {
        const dateParts = entry.posted_time.split(" ");
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const month = monthNames.indexOf(dateParts[1]);
        const day = parseInt(dateParts[2], 10);
        const year = parseInt(dateParts[3], 10);
        const timeParts = dateParts[4].split(":");
        let hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        const ampm = dateParts[5];

        if (ampm === "PM" && hour !== 12) {
          hour += 12;
        }

        const date = new Date(year, month, day, hour, minute);
        entry.timestamp = date.getTime();
      });

      result.sort((a, b) => b.timestamp - a.timestamp);

      const limit = 6;
      const limitedResult = result.slice(0, limit);

      res.send(limitedResult);
    });

    app.get("/blog/category", async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: "$category",
          },
        },
      ];

      const distinctCategories = await blogCollection
        .aggregate(pipeline)
        .toArray();
      const categories = distinctCategories.map((category) => category._id);
      res.send(categories);
    });

    app.get("/topTen", async (req, res) => {
      const pipeline = [
      {
        $project: {
          _id: 1,
          title:1,
          author_info:1,
          long_description: 1,
          long_description_length: { $strLenCP: '$long_description' }
        }
      },
      {
        $sort: { long_description_length: -1 }
      },
      {
        $limit: 10
      }
    ];

    const result = await blogCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    app.get("/wishlist", async (req, res) => {
      // console.log(req.cookies);
      const email = req.query?.email;
      let query = {};
      if (email) {
        query = {
          user_email: email,
        };
      }
      // console.log("Form Api : ", req.body);
      const result = await wishlistCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/blogDetails/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };

      const result = await blogCollection.findOne(query);
      res.send(result);
    });

    app.get("/comments", async (req, res) => {
      let query = {};
      if (req.query?.blog_id) {
        query = { blog_id: req.query.blog_id };
      }
      // console.log("Form Api : ", req.body);
      const result = await commentCollection.find(query).limit(4).toArray();
      res.send(result);
    });

    app.post("/blog", async (req, res) => {
      const newBlog = req.body;
      const result = await blogCollection.insertOne(newBlog);
      res.send(result);
    });

    app.post("/wishlist", async (req, res) => {
      const newWish = req.body;
      // console.log("Form Api : ", req.body);
      const result = await wishlistCollection.insertOne(newWish);
      res.send(result);
    });

    app.post("/comments", async (req, res) => {
      const newComment = req.body;
      // console.log("Form Api : ", req.body);
      const result = await commentCollection.insertOne(newComment);
      res.send(result);
    });

    app.put("/blogDetails/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBlog = req.body;
      const blog = {
        $set: {
          title: updatedBlog.title,
          image: updatedBlog.image,
          category: updatedBlog.category,
          short_description: updatedBlog.short_description,
          long_description: updatedBlog.long_description,
        },
      };

      const result = await blogCollection.updateOne(filter, blog, options);
      res.send(result);
    });

    app.delete("/wish/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
    const result = await wishlistCollection.deleteOne(query);
      
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Unscripted website server is running.");
});

app.listen(port, () => {
  console.log(`Server is running or port: ${port}`);
});
