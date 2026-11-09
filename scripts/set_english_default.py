path = r"app/src/main/java/com/example/upad/viewmodel/RoutineViewModel.kt"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace('private val _appLanguage = MutableStateFlow("es")', 'private val _appLanguage = MutableStateFlow("en")')

with open(path, "w", encoding="utf-8") as f:
    f.write(text)
print("Updated default language in RoutineViewModel.kt to en")
