path_routine_vm = r"app/src/main/java/com/example/upad/viewmodel/RoutineViewModel.kt"
with open(path_routine_vm, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Update obtenerUidSeguro
old_uid = '''    private fun obtenerUidSeguro(userId: String): String {
        return if (userId == "PADRE_TEST" || userId.isBlank()) {
            com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid ?: ""
        } else {
            userId
        }
    }'''

new_uid = '''    private fun obtenerUidSeguro(userId: String): String {
        return if (userId == "PADRE_TEST" || userId.isBlank()) {
            val firebaseUid = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
            if (!firebaseUid.isNullOrEmpty()) firebaseUid else com.example.upad.data.LocalDataManager.getCurrentUserId()
        } else {
            userId
        }
    }'''

text = text.replace(old_uid, new_uid)
text = text.replace(old_uid.replace("\r\n", "\n"), new_uid)

# 2. Update doc device lookup fallback
old_doc_lookup = 'finalUid = doc.getString("padreId") ?: ""'
new_doc_lookup = 'finalUid = doc.getString("padreId") ?: com.example.upad.data.LocalDataManager.getCurrentUserId()'
text = text.replace(old_doc_lookup, new_doc_lookup)

old_catch = '''                } catch (e: Exception) {
                    e.printStackTrace()
                }'''
new_catch = '''                } catch (e: Exception) {
                    finalUid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                }'''
text = text.replace(old_catch, new_catch)
text = text.replace(old_catch.replace("\r\n", "\n"), new_catch)

with open(path_routine_vm, "w", encoding="utf-8") as f:
    f.write(text)
print("RoutineViewModel patched successfully")
