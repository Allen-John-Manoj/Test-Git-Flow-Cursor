"""
Utility functions module
"""


def greet(name: str) -> str:
    """
    Greet a person by name.
    
    Args:
        name: The name of the person to greet
        
    Returns:
        A greeting message
    """
    return f"Hello, {name}! Welcome to the utils module."


def add_numbers(a: float, b: float) -> float:
    """
    Add two numbers together.
    
    Args:
        a: First number
        b: Second number
        
    Returns:
        Sum of a and b
    """
    return a + b


def reverse_string(text: str) -> str:
    """
    Reverse a string.
    
    Args:
        text: The string to reverse
        
    Returns:
        The reversed string
    """
    return text[::-1]


def is_even(number: int) -> bool:
    """
    Check if a number is even.
    
    Args:
        number: The number to check
        
    Returns:
        True if number is even, False otherwise
    """
    return number % 2 == 0


if __name__ == "__main__":
    # Example usage
    print(greet("World"))
    print(f"Sum: {add_numbers(5, 3)}")
    print(f"Reversed: {reverse_string('Python')}")
    print(f"Is 4 even? {is_even(4)}")

