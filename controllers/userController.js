import bcrypt from 'bcrypt'
import validator  from 'validator';
import userModel from './../models/userModel.js';
import jwt from 'jsonwebtoken'
import {v2 as cloudinary} from 'cloudinary'
import doctorModel from './../models/doctorModel.js';
import appointmentModel from '../models/AppointmentModel.js';
import SSLCommerzPayment from 'sslcommerz-lts';
import FormData from 'form-data';



// api to register user
const registerUser = async (req,res) => {
    try {
        
        const { name, email, password} = req.body

        if ( !name || !password || !email) {
            return res.json({success:false, message:'Missing Details'})
        }

        if (!validator.isEmail(email)) {
            return res.json({success:false, message:'Enter a valid email'})
        }

        if (password.length < 6) {
            return res.json({success:false, message:'Enter a strong password'})
        }

        // hasing user password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password,salt)

        const userData = {
            name,
            email,
            password : hashedPassword
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        
        const token = jwt.sign({id:user._id}, process.env.JWT_SECRET )

        res.json({success:true,token})

    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
        
    }
}

// api for user login
const loginUser = async (req,res) => {
    
    try {
        
        const {email,password} = req.body
        const user = await userModel.findOne({email})

        if (!user) {
           return  res.json({success:false,message:'User does not exist'})
        }

        const isMatch = await bcrypt.compare(password,user.password)

        if (isMatch) {
            const token = jwt.sign({id:user._id}, process.env.JWT_SECRET)
            res.json({success:true,token})
        } else {
            res.json({success:false,message:"Invalid Info"})
        }

    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message})
    }

}

// API to get user profile data

    const getProfile = async (req,res) => {
        
        try {
            
            const { userId } =req.body
            const userData = await userModel.findById(userId).select('-password')

            res.json({success:true,userData})

        } catch (error) {
            console.log(error);
            res.json({success:false,message:error.message})
        }

    }

    // api to update user profile

    const updateProfile = async (req,res) => {
        
            try {
                
                const {userId, name, phone, address, dob, gender} = req.body
                const imageFile = req.file

                if (!name || !phone || !dob || !gender) {
                    return res.json({success:false,message:"Missing Details"})
                }

                await userModel.findByIdAndUpdate(userId, {name, phone, address:JSON.parse(address), dob, gender})

                if (imageFile) {
                    
                    // upload image to cloudinary

                    const imageUpload = await cloudinary.uploader.upload(imageFile.path,{resource_type:'image'})
                    const imageURL = imageUpload.secure_url

                    await userModel.findByIdAndUpdate(userId,{image:imageURL})

                }

                res.json({success:true,message:"Profile Updated"})


            } catch (error) {
                console.log(error);
            res.json({success:false,message:error.message})
            }

    }

    // api to book appointment

    const bookAppointment = async (req,res) => {
       
        try {
            
            const {userId, docId, slotDate, slotTime} = req.body

            const docData = await doctorModel.findById(docId).select('-password')

            if (!docData.available) {
                return res.json({success:false,message:'Doctor Not Available'})
            }

            let slots_booked = docData.slots_booked

            // checking for slots

            if (slots_booked[slotDate]) {
                if (slots_booked[slotDate].includes(slotTime)) {
                    return res.json({success:false,message:'Slot Not Available'})
                } else {
                    slots_booked[slotDate].push(slotTime)
                }
            } else {
                slots_booked[slotDate] = []
                slots_booked[slotDate].push(slotTime)
            }

            const userData = await userModel.findById(userId).select('-password')

            delete docData.slots_booked

            const appointmentData = {
                userId,
                docId,
                userData,
                docData,
                amount:docData.fees,
                slotTime,
                slotDate,
                date: Date.now()
            }

            const newAppointment = new appointmentModel(appointmentData)
            await newAppointment.save()

            // saving new data in docData
            await doctorModel.findByIdAndUpdate(docId,{slots_booked})

            res.json({success:true,message:'Appointment Booked'})


        } catch (error) {
            console.log(error);
            res.json({success:false,message:error.message})
        }

    }

    // api to get user appointments for frontend

    const listAppointment = async (req,res) => {
        
        try {
            
            const {userId} = req.body
            const appointments = await appointmentModel.find({userId})

            res.json({success:true,appointments})

        } catch (error) {
            console.log(error);
            res.json({success:false,message:error.message})
        }

    }

    // api to cancel appointment
    const cancelAppointment = async (req,res) => {
        
        try {
            
            const { userId, appointmentId} = req.body

            const appointmentData = await appointmentModel.findById(appointmentId)

            // verify appointment user

            if (appointmentData.userId !== userId) {
                return res.json({success:false,message:'Not Authorized'})
            }

            await appointmentModel.findByIdAndUpdate(appointmentId, {cancelled:true})

            // removing doctor slot

            const { docId, slotDate, slotTime} = appointmentData

            const doctorData = await doctorModel.findById(docId)

            let slots_booked = doctorData.slots_booked

            slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

            await doctorModel.findByIdAndUpdate(docId,{slots_booked})

            res.json({success:true, message:'Appointment Cancelled'})

        } catch (error) {
            console.log(error);
            res.json({success:false,message:error.message})
        }

    }

// sslz commerz 


const sslcz = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        // Find the appointment by ID
        const appointmentData = await appointmentModel.findById(appointmentId);

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled' });
        }

        

        // Prepare payment options
        const options = {
        total_amount: 100,
        currency: 'BDT',
        tran_id: appointmentId, // use unique tran_id for each api call
        success_url: 'http://https://tanvirahmedshihab.netlify.app',
        fail_url: 'http://localhost:5173/my-appointments',
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Customer Name',
        cus_email: 'customer@example.com',
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
        };

        // Create an order using SSLCommerz
        const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.API_KEY, false); // false for sandbox mode
        const orderResponse = await sslcz.init(options) ;
        console.log('SSLCommerz response: ', orderResponse); 
        // Handle SSLCommerz response
        if (orderResponse && orderResponse.GatewayPageURL) {
            res.json({ success: true, GatewayPageURL: orderResponse.GatewayPageURL });
        } else {
            res.json({ success: false, message: 'Failed to initiate payment' });
        }

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }

//api to verify payment of sslz 


};
    

export {registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, sslcz}