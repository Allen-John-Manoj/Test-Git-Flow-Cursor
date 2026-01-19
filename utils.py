def greet(name: str) -> str:
    return f"Hello, {name}! Welcome to the utils module."


def add_numbers(a: float, b: float) -> float:
    return a + b

def reverse_string(text: str) -> str:
    print(f"Reversing string: {text}") #NEW LINE
    return text[::-1]


def is_even(number: int) -> bool:
    return number % 2 == 0


if __name__ == "__main__":
    # Example usage
    print(greet("World"))
    print(f"Sum: {add_numbers(5, 3)}")
    print(f"Reversed: {reverse_string('Python')}")
    print(f"Is 4 even? {is_even(4)}")

