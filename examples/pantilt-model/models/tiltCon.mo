model tiltCon
    parameter Real speed;
    parameter Real startPos;
    output Real pos;
initial equation
    pos = startPos;
equation
    der(pos) = 1.1 * speed;
end tiltCon;