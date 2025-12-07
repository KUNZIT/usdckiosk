// Arduino Leonardo WebUSB Relay Control Sketch with Auto-Timer and Button Input
const int RELAY_PIN = 2; // Connect relay to digital pin 2
const int BUTTON_PIN = 4; // Connect physical button (input) to digital pin 4
unsigned long relayStartTime = 0;
bool relayTimerActive = false;
bool commandSentOnPress = false;
void setup() {
  Serial.begin(9600);
  // Setup RELAY pin
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Start with relay OFF
  // Setup onboard LED
  pinMode(LED_BUILTIN, OUTPUT);
  //  The button must be wired between pin 4 and GND.
  // The pin will read LOW when pressed.
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.println("Relay Controller Ready!");
}
void loop() {
  
  if (Serial.available()) {
    String command = Serial.readString();
    command.trim();
    
    if (command == "RELAY_ON") {
      digitalWrite(RELAY_PIN, HIGH);
      digitalWrite(LED_BUILTIN, HIGH);
      relayStartTime = millis(); // Start timer
      relayTimerActive = true;
      Serial.println("RELAY_ON_OK");
    }
  }
   // --- Relay Auto-Off Logic ---
  
  if (relayTimerActive && (millis() - relayStartTime >= 7000)) {
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(LED_BUILTIN, LOW);
    relayTimerActive = false;
    Serial.println("RELAY_AUTO_OFF");
  }
// --- Button Monitoring Logic (Arduino to App) ---
  int buttonState = digitalRead(BUTTON_PIN);

  if (buttonState == LOW) {
    if (!commandSentOnPress) {
      
      Serial.println("BUTTON_4_PRESSED");
      
      
      commandSentOnPress = true;
    }
  } else {
    
    commandSentOnPress = false;
  }
  
  // A small delay to keep the loop from spinning too fast
  delay(5);
}
