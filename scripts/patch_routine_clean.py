path = r"app/src/main/java/com/example/upad/viewmodel/RoutineViewModel.kt"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Replace in obtenerUidSeguro
old_uid = 'com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid ?: ""'
new_uid = 'com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid ?: com.example.upad.data.LocalDataManager.getCurrentUserId()'
text = text.replace(old_uid, new_uid)

# Replace in finalUid fallback
old_doc = 'finalUid = doc.getString("padreId") ?: ""'
new_doc = 'finalUid = doc.getString("padreId") ?: com.example.upad.data.LocalDataManager.getCurrentUserId()'
text = text.replace(old_doc, new_doc)

extra_check = '''            if (finalUid.isEmpty() || finalUid == "PADRE_TEST") {
                finalUid = com.example.upad.data.LocalDataManager.getCurrentUserId()
            }'''

anchor = 'val listaActual = try {'
text = text.replace(anchor, extra_check + '\n\n            ' + anchor)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)
print("RoutineViewModel cleanly patched")
