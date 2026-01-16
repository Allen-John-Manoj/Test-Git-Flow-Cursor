def add(a: float, b: float) -> float:
    return a + b


def subtract(a: float, b: float) -> float:
    print(f"Subtracting {a} - {b}") #NEW LINE
    return a - b
    


def multiply(a: float, b: float) -> float:
    return a * b


def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("Cannot divide by zero!")
    return a / b


def power(base: float, exponent: float) -> float:
    return base ** exponent


if __name__ == "__main__":
    print(f"10 + 5 = {add(10, 5)}")
    print(f"10 - 5 = {subtract(10, 5)}")
    print(f"10 * 5 = {multiply(10, 5)}")
    print(f"10 / 5 = {divide(10, 5)}")
    print(f"2 ^ 3 = {power(2, 3)}")

