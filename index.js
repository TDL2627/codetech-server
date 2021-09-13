const express = require('express');
const app = express();
const path = require('path');
const bodyparser = require('body-parser')
const { body, validationResult } = require('express-validator');
// Firebase configurations
const admin = require('firebase-admin');
const secretKeys = require('./permission.json');
const { allowedNodeEnvironmentFlags } = require('process');
var cors = require('cors')
admin.initializeApp({
    credential: admin.credential.cert(secretKeys)
})


// // Firestore and Authentication
const firestore = admin.firestore();
const auth = admin.auth();

app.set('port', process.env.port || 3400) 
app.use(bodyparser.json());
app.use(cors())

app.get('/', (req, res) => {
    const teamName = "Developed by Tech Express"
    res.send(`<h1>Firebase and Express <br/> ${teamName}<h1>`);
})

//get all users
app.get('/users', (req, res, next) => {
    const response = [];
    firestore.collection('users').get().then(users => {
        users.forEach(user => {
            response.push({ id: user.id, ...user.data() })
        })
        return res.send(response)
    }).catch(error => {
        return res.status(500).send(error.message);
    })
})
app.get('/users/:id', (req, res, next) => {
    const id = req.params.id;
    firestore.collection('users').doc(id).get().then(user => {
        res.status(200).send({
            id: user.id, ...user.data()
        })
    }).catch(error => {
        return res.status(500).send(error.message);
    })
})

// Post  method with Custom Claims
// when posting with postman use admin
app.post('/register', (req, res, next) => {
    const user = req.body
    auth.createUser(user).then(userdata => {
        firestore.collection('users').doc(userdata.uid).
        set({name:user.name,email:user.email,admin:user.admin}).then(()=>{
            if (user.admin){
                auth.setCustomUserClaims(userdata.uid,{admin:true}).then(() => {
                    res.send('Admin is created')
                }).catch(error=>{
                    return res.status(500).send(error.message);})
            }
            else if(user.admin===undefined || !user.admin){
                auth.setCustomUserClaims(userdata.uid, {admin: false}).then(() => {
                    res.send('User is created')})
            }
        }).catch(error=> {
                return res.status(500).send(error.message);})
    }).catch(error => {
        return res.status(500).send(error.message);})
})

//Post users using authentication and validation
const userCreationValidators = [
    body('email').isEmail().withMessage("Email is invalid!"),
    body('name').isLength({min: 1}).withMessage("name is not entered"),
    body('password').isLength({min: 5}).withMessage("password should contain more than five characters")
   ];
   app.post("/create", userCreationValidators, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
     return res.status(400).json({ errors: errors.array() });
    }
    const user = req.body
        auth.createUser(user).then(userdata => {
          firestore.collection('users').doc(userdata.uid).set({name:user.name,email:user.email}).then(()=>{
              res.status(200).send('user is created');
          }).catch(error => {
        return res.status(500).send(error.message);
    })
        }).catch(error => {
            return res.status(500).send(error.message);
        })
    })

// Delete Method
app.delete('/users/:id', function(req, res, next){
    const id = req.params.id;
    if(id===undefined){
        res.status(500).send('User is not defined')
    }
    else{
        auth.deleteUser(id).then(()=>{
            firestore.collection('users').doc(id).delete().then(user=>{
                res.status(200).send('user has been deleted')
            })
        })
        
    }
    
})

//Update users
app.put('/users/:id', function(req, res, next){
    const id = req.params.id;
    const users = req.body;
    if (id === undefined && users === undefined) {
        res.status(500).send('User is not defined')
    } else {
            firestore.collection('users').doc(id).update(users).then(response => {
                res.status(200).send('Users have been updated')

        })
    }
})


//  create a blog doc where each id will be the same as the user's id
app.post("/blogs/:id", (req, res, next) => {
    let id = req.params.id;
    const blog = req.body;
      const blog_id = firestore.collection('blogs').doc();
      blog_id.set({
          title : req.body.title,
          author : req.body.author,
          details : req.body.details,
          id : req.params.id,
        // developing : req.body.developing,
        // blog_id : blog_id.id,

        })
})
//  get all blogs for a certain user 
app.get('/blogs/:id', (req, res, next) =>{
    const id = req.params.id;
    const allBlogs = [];
    firestore.collection('blogs').get().then((blogs) =>{
      blogs.forEach(blog => {
        allBlogs.push({
          id: blog.id,
          ...blog.data()
        })
      })
     const userBlogs = allBlogs.filter(blog => blog.id === id);
      res.status(200).send(userBlogs);
    }).catch(error => {
      res.status(500).send(error.message);
    })
  })

//   get all blogs for everyone
app.get('/blogs', (req, res, next) => {
    const response = [];
    firestore.collection('blogs').get().then(blogs => {
        blogs.forEach(blogs => {
            response.push({ id: blogs.id, ...blogs.data() })
        })
        return res.send(response)
    })
})
//Delete blog by ID
app.delete('/blogs/:id', (req, res, next)=>{
    const id = req.params.id;
    if (id === undefined) {
        res.status(500).send('Blog not defined')
    } else {
        firestore.collection('blogs').doc(id).delete().then(response =>{
            res.status(200).send('Blog has been deleted');
        })
    }
})
// update one skill at a time for a user
app.put('/blogs/:blog_id', (req, res, next) =>{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array(),
            message: "Date Format: dd/MM/yyyy"
        });
    }
    const blog_id = req.params.blog_id;
    const newBlog = req.body;
      firestore.collection('blogs').doc(blog_id).update(newBlog).then(response =>{
        res.status(200).json({success: true,
          message: req.body.name+' has been updated successful',newBlog});
      }).catch(error => {
      res.status(500).json({success: false, message: "There is no blog record corresponding to the provided identifier"})
      })
  })

// image upload
app.post('/upload', (req, res, next) => {
    const file = req.body;
    firestore.collection('pictures').doc().set({
      url : file.url
    }).then(() => {
      res.status(200).json({success: true,
        message: 'picture has been added successful'});
    }).catch(error => {
      res.status(500).json({success: false, message: "There is no url record corresponding to the provided identifier"})
      })
  })


// 
app.listen(app.get('port'), server =>{
    console.info(`Server listen on port ${app.get('port')}`);
})