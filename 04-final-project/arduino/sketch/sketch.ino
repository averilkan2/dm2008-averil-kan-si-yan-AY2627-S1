// sensor connected to analog pin A0
const int ultraPin = A0; 

void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(ultraPin);

  // Convert analogue reading to distance in cm
  float distanceCM = sensorValue * 520.0 / 1023.0;

  // Send ONLY the numerical distance
  Serial.println(distanceCM, 1);

  delay(20);
}