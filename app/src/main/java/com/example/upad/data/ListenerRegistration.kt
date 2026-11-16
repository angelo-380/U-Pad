package com.example.upad.data

/** Suscripción a datos que se cancela con remove() (reemplaza a la de Firestore, que ya no se usa). */
fun interface ListenerRegistration {
    fun remove()
}
