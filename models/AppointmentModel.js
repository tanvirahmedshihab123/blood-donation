import mongoose from "mongoose";

const appointmentsSchema = new mongoose.Schema({
    userId: { type: String, required: true},
    docId: { type: String, required: true},
    slotDate: { type: String, required: true},
    slotTime: { type: String, required: true},
    userData: { type: Object, required: true},
    docData: { type: Object, required: true},
    ammount: { type: Number},
    date: { type: Number, required: true},
    cancelled: { type: Boolean, default: false},
    payment: { type: Boolean, default: false},
    isCompleted: { type: Boolean, default:false}



})

const appointmentModel = mongoose.models.appointment || mongoose.model('appointment',appointmentsSchema)

export default appointmentModel