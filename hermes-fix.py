import yaml

with open('/home/ubuntu/.hermes/config.yaml', 'r') as f:
    content = f.read()

  # Try to fix common indentation issue: providers: accidentally indented
    lines = content.split('\n')
    fixed = []
    for line in lines:
      # If 'providers:' is indented (starts with spaces), dedent it to col 0
        if line.lstrip() == 'providers:' and line.startswith(' '):
          fixed.append('providers:')
        else:
          fixed.append(line)

with open('/home/ubuntu/.hermes/config.yaml', 'w') as f:
    f.write('\n'.join(fixed))

    print("Done. Validating...")
with open('/home/ubuntu/.hermes/config.yaml', 'r') as f:
      yaml.safe_load(f)


print("YAML OK")