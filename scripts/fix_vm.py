path = r"app/src/main/java/com/example/upad/viewmodel/RoutineViewModel.kt"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

target = """        viewModelScope.launch {
                        if (finalUid.isEmpty() || finalUid == "PADRE_TEST") {
                finalUid = com.example.upad.data.LocalDataManager.getCurrentUserId()
            }

            val listaActual = try {
                repository.obtenerRutinasDelPadreDirectoPorDia(uidValido,"""

replacement = """        viewModelScope.launch {
            var targetUid = uidValido
            if (targetUid.isEmpty() || targetUid == "PADRE_TEST") {
                targetUid = com.example.upad.data.LocalDataManager.getCurrentUserId()
            }

            val listaActual = try {
                repository.obtenerRutinasDelPadreDirectoPorDia(targetUid,"""

text = text.replace(target, replacement)
text = text.replace(target.replace("\r\n", "\n"), replacement)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)
print("Fixed lines in RoutineViewModel.kt successfully")
