#include <pear.h>

int
main(int argc, char *argv[]) {
  pear_id_t id = ID;
  const char *name = NAME;

  return pear_launch(argc, argv, id, name);
}
