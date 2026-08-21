const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const crypto = require("crypto");

const Invite = require("../models/invite");


router.post("/create", authenticate, requireAdmin, async(req,res)=>{

    try{

        const { email, role } = req.body;

        if(!email){
            return res.status(400).json(
                "Email required."
            );
        }

        const token =
            crypto.randomBytes(32)
            .toString("hex");

        const invite = new Invite({
            email,
            role: role || "staff",
            token,
            expiresAt:
                new Date(
                    Date.now() +
                    24*60*60*1000
                )

        });

        await invite.save();

        const inviteLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/staffRegister/${token}`;

        res.status(200).json({

            message:"Invite created",

            inviteLink,

            invite

        });

    }catch(err){

        res.status(500).json(err);

    }

});


router.get("/verify/:token", async(req,res)=>{

    try{

        const invite =
            await Invite.findOne({

                token:req.params.token

            });

        if(!invite){

            return res
            .status(404)
            .json("Invalid invite.");

        }

        if(invite.used){

            return res
            .status(400)
            .json("Invite already used.");

        }

        if(
            invite.expiresAt <
            new Date()
        ){

            return res
            .status(400)
            .json("Invite expired.");

        }

        res.status(200).json({

            valid:true,

            email:invite.email

        });

    }catch(err){

        res.status(500).json(err);

    }

});

router.get("/all", authenticate, requireAdmin, async(req,res)=>{

    try{

        const invites =
            await Invite.find()
            .sort({
                createdAt:-1
            });

        res.status(200).json(
            invites
        );

    }catch(err){

        res.status(500).json(err);

    }

});


router.delete("/:id", authenticate, requireAdmin, async(req,res)=>{

    try{

        await Invite.findByIdAndDelete(
            req.params.id
        );

        res.status(200).json(
            "Invite revoked."
        );

    }catch(err){

        res.status(500).json(err);

    }

});

module.exports = router;